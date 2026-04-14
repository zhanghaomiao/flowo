import uuid
from unittest.mock import MagicMock, patch

from app.plugin.client.parsers import RecordParser, _extract_rules


class MockLogRecord:
    """Simulates a Snakemake LogRecord object with dynamic attributes."""

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


# --- Parser Component Tests ---


def test_workflow_started_parsing():
    """Test workflow startup event parsing."""
    wf_id = str(uuid.uuid4())
    mock_record = MockLogRecord(workflow_id=wf_id, snakefile="/path/to/Snakefile")

    # Mocking _extract_rules since it depends on global snakemake state
    with patch(
        "app.plugin.client.parsers._extract_rules", return_value=[]
    ) as mock_extract:
        result = RecordParser.workflow_started(mock_record)
        assert str(result.workflow_id) == wf_id
        assert result.snakefile == "/path/to/Snakefile"
        mock_extract.assert_called_once()


def test_run_info_parsing():
    """Test run statistics parsing."""
    stats = {"rule1": 10, "rule2": 5, "total": 15}
    mock_record = MockLogRecord(stats=stats)
    result = RecordParser.run_info(mock_record)
    assert result.stats == stats

    # Test missing stats
    empty_record = MockLogRecord()
    result = RecordParser.run_info(empty_record)
    assert result.stats == {}


def test_job_info_parsing_exhaustive():
    """Exhaustive test for job metadata parsing across versions."""
    # Case 1: Standard Snakemake 8+ / 9+ structure
    mock_record = MockLogRecord(
        jobid=1,
        rule_name="align",
        threads=8,
        rule_msg="Aligning reads",
        reason="Missing output",
        shellcmd="bwa mem ...",
        priority=10,
        input=["r1.fq", "r2.fq"],
        output=["align.bam"],
        log=["align.log"],
        benchmark="align.bench",
    )

    # Mock resources (Snakemake uses a custom object that is iterable)
    resources = MagicMock()
    resources._names = ["mem_mb", "nodes"]
    resources.__iter__ = MagicMock(return_value=iter([4096, 1]))
    mock_record.resources = resources

    result = RecordParser.job_info(mock_record)

    assert result.job_id == 1
    assert result.rule_name == "align"
    assert result.threads == 8
    assert result.resources["mem_mb"] == 4096
    assert "nodes" not in result.resources  # nodes should be filtered out
    assert result.benchmark == ["align.bench"]  # converted to list


def test_job_started_parsing_variants():
    """Test job startup with single vs multiple job IDs (Snakemake 7 vs 8)."""
    # Case 1: Single ID (Legacy or simple job)
    rec_single = MockLogRecord(jobs=42)
    assert RecordParser.job_started(rec_single).job_ids == [42]

    # Case 2: List of IDs (Groups)
    rec_list = MockLogRecord(jobs=[42, 43, 44])
    assert RecordParser.job_started(rec_list).job_ids == [42, 43, 44]

    # Case 3: Missing jobs
    rec_none = MockLogRecord()
    assert RecordParser.job_started(rec_none).job_ids == []


def test_job_finished_and_error_id_mapping():
    """Ensure we handle 'jobid' (v7) and 'job_id' (v8) consistently."""
    # Finished v7
    assert RecordParser.job_finished(MockLogRecord(jobid=10)).job_id == 10
    # Finished v8
    assert RecordParser.job_finished(MockLogRecord(job_id=20)).job_id == 20

    # Error v7
    assert RecordParser.job_error(MockLogRecord(jobid=30)).job_id == 30
    # Error v8
    assert RecordParser.job_error(MockLogRecord(job_id=40)).job_id == 40


def test_group_events_parsing():
    """Test group-specific event parsing."""
    # Group Info
    rec_group = MockLogRecord(group_id=1, jobs=[10, 11])
    result = RecordParser.group_info(rec_group)
    assert result.group_id == 1
    assert result.jobs == [10, 11]

    # Group Error
    rec_ge = MockLogRecord(
        groupid=1, aux_logs=["err.log"], job_error_info={"job_id": 10}
    )
    result = RecordParser.group_error(rec_ge)
    assert result.groupid == 1
    assert result.job_error_info["job_id"] == 10


def test_error_schema_resilience():
    """Test that generic errors handle missing traceback/location gracefully."""
    rec = MockLogRecord(exception="Crash")
    result = RecordParser.error(rec)
    assert result.exception == "Crash"
    assert result.traceback is None
    assert result.location is None


# --- Snakemake Internal Simulation Tests ---


def test_extract_rules_simulation():
    """Test rule extraction by simulating Snakemake's internal rule objects."""
    # We mock the internal imports used in _extract_rules by patching sys.modules
    from unittest.mock import MagicMock

    mock_snakemake = MagicMock()
    mock_wf = MagicMock()
    mock_snakemake.workflow.workflow = mock_wf

    rule1 = MagicMock()
    rule1.name = "rule1"
    rule1.shellcmd = "echo hi"
    rule1.is_run = False

    rule2 = MagicMock()
    rule2.name = "rule2"
    rule2.shellcmd = None
    rule2.script = None
    rule2.wrapper = None
    rule2.is_run = True  # Simulated 'run:' block

    mock_wf.rules = [rule1, rule2]

    # We patch the imports inside the module directly
    with (
        patch("app.plugin.client.parsers.snakemake", mock_snakemake, create=True),
        patch("app.plugin.client.parsers.notebook", MagicMock(), create=True),
        patch("app.plugin.client.parsers.wrapper", MagicMock(), create=True),
        patch("app.plugin.client.parsers.get_source", MagicMock(), create=True),
        patch("app.plugin.client.parsers.contains_wildcard", MagicMock(), create=True),
    ):
        rules = _extract_rules()
        assert len(rules) == 2
        assert rules[0].name == "rule1"
        assert rules[0].language == "bash"
        assert rules[1].name == "rule2"
        assert rules[1].language == "python"


def test_extract_rules_no_snakemake():
    """Test that _extract_rules fails gracefully if Snakemake is missing or global state is empty."""
    with patch("app.plugin.client.parsers.snakemake", MagicMock(), create=True):
        # By default the mock won't have the expected structure, or we can make it return None
        with patch("app.plugin.client.parsers.getattr", return_value=None):
            rules = _extract_rules()
            assert rules == []
