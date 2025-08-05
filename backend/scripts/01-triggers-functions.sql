-- Function to send notifications via LISTEN/NOTIFY with status change tracking
CREATE OR REPLACE FUNCTION notify_table_changes()
RETURNS trigger AS $$
DECLARE
    payload JSONB;
    record_id_text TEXT;
    workflow_id_text TEXT;
    old_status TEXT;
    new_status TEXT;
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
    
    -- Create base notification payload
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
    
    -- Add status change information for UPDATE operations
    IF TG_OP = 'UPDATE' THEN
        -- Extract only status for comparison
        old_status := OLD.status;
        new_status := NEW.status;
        
        -- Add status change info to payload
        payload := payload || jsonb_build_object(
            'old_status', old_status,
            'new_status', new_status,
            'status_changed', (old_status != new_status)
        );
    ELSIF TG_OP = 'INSERT' THEN
        -- For INSERT, only include new status
        payload := payload || jsonb_build_object(
            'new_status', NEW.status,
            'status_changed', true
        );
    ELSIF TG_OP = 'DELETE' THEN
        -- For DELETE, only include old status
        payload := payload || jsonb_build_object(
            'old_status', OLD.status,
            'status_changed', true
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

-- Enhanced function to update timestamps with notification throttling
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for workflows table
DROP TRIGGER IF EXISTS workflows_notify ON workflows;
CREATE TRIGGER workflows_notify
    AFTER INSERT OR UPDATE OR DELETE ON workflows
    FOR EACH ROW EXECUTE FUNCTION notify_table_changes();

-- Create triggers for jobs table  
DROP TRIGGER IF EXISTS jobs_notify ON jobs;
CREATE TRIGGER jobs_notify
    AFTER INSERT OR UPDATE OR DELETE ON jobs
    FOR EACH ROW EXECUTE FUNCTION notify_table_changes(); 