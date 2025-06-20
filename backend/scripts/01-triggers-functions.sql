-- Function to send notifications via LISTEN/NOTIFY
CREATE OR REPLACE FUNCTION notify_table_changes()
RETURNS trigger AS $$
DECLARE
    payload JSONB;
    record_id_text TEXT;
    workflow_id_text TEXT;
BEGIN
    -- Get record ID as text    
    record_id_text := CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT
        ELSE NEW.id::TEXT
    END;

    IF TG_TABLE_NAME = 'workflows' THEN
        workflow_id_text := record_id_text;
    ELSIF TG_TABLE_NAME = 'jobs' THEN
        workflow_id_text := CASE
            WHEN TG_OP = 'DELETE' THEN OLD.workflow_id::TEXT
            ELSE NEW.workflow_id::TEXT
        END;
    ELSE
        workflow_id_text := NULL;
    END IF;
    
    -- Create notification payload
    payload := jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP),
        'record_id', record_id_text
    );
    
    IF workflow_id_text IS NOT NULL THEN
        payload := payload || jsonb_build_object(
            'workflow_id', workflow_id_text
        );
    END IF;
    
    -- Send notification
    PERFORM pg_notify('table_changes', payload::TEXT);
    
    -- Also send specific table notifications
    PERFORM pg_notify(
        'table_changes_' || TG_TABLE_NAME, 
        payload::TEXT
    );

    RETURN CASE 
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to update timestamps (for tables that have updated_at columns)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for workflows table
CREATE TRIGGER workflows_notify
    AFTER INSERT OR UPDATE OR DELETE ON workflows
    FOR EACH ROW EXECUTE FUNCTION notify_table_changes();

-- Create triggers for jobs table
CREATE TRIGGER jobs_notify
    AFTER INSERT OR UPDATE OR DELETE ON jobs
    FOR EACH ROW EXECUTE FUNCTION notify_table_changes(); 