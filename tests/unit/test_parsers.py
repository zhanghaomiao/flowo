import uuid
from unittest.mock import MagicMock, patch

from app.plugin.client.parsers import RecordParser, _extract_rules
from app.plugin.schemas import RuleInfoSchema


class MockLogRecord:
    """Simple log record stand-in with dynamic attributes."""

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)


def test_workflow_started_calls_rule_extraction():
    workflow_id = str(uuid.uuid4())
    record = MockLogRecord(workflow_id=workflow_id, snakefile="/tmp/Snakefile")

    extracted_rules = [RuleInfoSchema(name="all", code=None, language=None)]
    with patch(
        "app.plugin.client.parsers._extract_rules", return_value=extracted_rules
    ) as extract_rules:
        result = RecordParser.workflow_started(record)

    assert str(result.workflow_id) == workflow_id
    assert result.snakefile == "/tmp/Snakefile"
    assert result.rules == extracted_rules
    extract_rules.assert_called_once_with()


def test_run_info_defaults_to_empty_stats():
    assert RecordParser.run_info(MockLogRecord(stats={"total": 2})).stats == {
        "total": 2
    }
    assert RecordParser.run_info(MockLogRecord()).stats == {}


def test_job_info_filters_internal_resources_and_normalizes_benchmark():
    record = MockLogRecord(
        jobid=7,
        rule_name="align",
        threads=8,
        rule_msg="Align reads",
        wildcards={"sample": "A"},
        reason="Missing output",
        shellcmd="bwa mem ...",
        priority=50,
        input=["reads_1.fq", "reads_2.fq"],
        log=["align.log"],
        output=["align.bam"],
        benchmark="align.benchmark.txt",
    )
    resources = MagicMock()
    resources._names = ["mem_mb", "_cores", "nodes", "disk_mb"]
    resources.__iter__ = MagicMock(return_value=iter([4096, 2, 1, 2048]))
    record.resources = resources

    result = RecordParser.job_info(record)

    assert result.job_id == 7
    assert result.rule_name == "align"
    assert result.resources == {"mem_mb": 4096, "disk_mb": 2048}
    assert result.benchmark == ["align.benchmark.txt"]


def test_job_info_keeps_benchmark_list_unchanged():
    record = MockLogRecord(
        jobid=8,
        rule_name="sort",
        threads=2,
        rule_msg="Sort BAM",
        reason=None,
        shellcmd=None,
        priority=1,
        input=["align.bam"],
        log=[],
        output=["sorted.bam"],
        benchmark=["first.tsv", "second.tsv"],
    )

    result = RecordParser.job_info(record)

    assert result.benchmark == ["first.tsv", "second.tsv"]


def test_job_info_defaults_optional_fields_when_record_is_sparse():
    result = RecordParser.job_info(MockLogRecord())

    assert result.job_id == 0
    assert result.rule_name == ""
    assert result.threads == 1
    assert result.rule_msg is None
    assert result.wildcards == {}
    assert result.reason is None
    assert result.shellcmd is None
    assert result.priority is None
    assert result.input is None
    assert result.log is None
    assert result.output is None
    assert result.benchmark is None
    assert result.resources == {}


def test_job_started_accepts_int_list_and_missing_values():
    assert RecordParser.job_started(MockLogRecord(jobs=42)).job_ids == [42]
    assert RecordParser.job_started(MockLogRecord(jobs=[42, 43])).job_ids == [42, 43]
    assert RecordParser.job_started(MockLogRecord(jobs=None)).job_ids == []
    assert RecordParser.job_started(MockLogRecord()).job_ids == []


def test_job_finished_and_error_support_legacy_and_new_job_id_fields():
    assert RecordParser.job_finished(MockLogRecord(jobid=10)).job_id == 10
    assert RecordParser.job_finished(MockLogRecord(job_id=11)).job_id == 11
    assert RecordParser.job_error(MockLogRecord(jobid=20)).job_id == 20
    assert RecordParser.job_error(MockLogRecord(job_id=21)).job_id == 21


def test_group_events_and_generic_error_are_parsed():
    group_info = RecordParser.group_info(MockLogRecord(group_id=3, jobs=[10, 11]))
    assert group_info.group_id == 3
    assert group_info.jobs == [10, 11]

    group_error = RecordParser.group_error(
        MockLogRecord(groupid=4, aux_logs=["stderr.log"], job_error_info={"job_id": 99})
    )
    assert group_error.groupid == 4
    assert group_error.aux_logs == ["stderr.log"]
    assert group_error.job_error_info == {"job_id": 99}

    error = RecordParser.error(MockLogRecord(exception="boom"))
    assert error.exception == "boom"
    assert error.location is None
    assert error.traceback is None


def test_rulegraph_defaults_to_empty_mapping():
    assert RecordParser.rulegraph(MockLogRecord(rulegraph={"nodes": []})).rulegraph == {
        "nodes": []
    }
    assert RecordParser.rulegraph(MockLogRecord()).rulegraph == {}


def test_extract_rules_returns_empty_when_no_global_workflow_exists():
    with patch("app.plugin.client.parsers.getattr", return_value=None):
        assert _extract_rules() == []
