import React, { useCallback, useEffect } from 'react';

import { DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Divider,
  Form,
  Input,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';

import {
  getCatalogQueryKey,
  listCatalogsQueryKey,
  updateCatalogMutation,
} from '@/client/@tanstack/react-query.gen';
import type { CatalogDetail, CatalogSummary } from '@/client/types.gen';
import AuthBlobImage from '@/components/shared/AuthBlobImage';

interface EditModalProps {
  open: boolean;
  catalog: CatalogSummary | CatalogDetail | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const EditCatalogModal: React.FC<EditModalProps> = ({
  open,
  catalog,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const updateMutation = useMutation(updateCatalogMutation());

  const invalidateCatalogQueries = useCallback(() => {
    if (!catalog?.id) return;
    void queryClient.invalidateQueries({ queryKey: listCatalogsQueryKey({}) });
    void queryClient.invalidateQueries({
      queryKey: getCatalogQueryKey({ path: { catalog_ref: catalog.id } }),
    });
  }, [catalog?.id, queryClient]);

  const dagPreviewStatusNoop = useCallback(() => {}, []);

  const dagPreviewUrl = catalog?.id
    ? `/api/v1/catalog/${encodeURIComponent(catalog.id)}/dag/preview`
    : '';

  const dagPreviewUploadRequest = async (opts: UploadRequestOption) => {
    const { file, onError, onSuccess } = opts;
    if (!dagPreviewUrl) {
      onError?.(new Error('No catalog'));
      return;
    }
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file as File);
    try {
      const res = await fetch(dagPreviewUrl, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const body = (await res.json()) as { detail?: unknown };
          if (typeof body.detail === 'string') detail = body.detail;
        } catch {
          /* ignore */
        }
        throw new Error(detail);
      }
      invalidateCatalogQueries();
      message.success('DAG preview image saved');
      onSuccess?.({}, new XMLHttpRequest());
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to upload image');
      onError?.(e as Error);
    }
  };

  const clearDagPreview = async () => {
    if (!dagPreviewUrl) return;
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(dagPreviewUrl, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        message.error('Could not remove preview image');
        return;
      }
      invalidateCatalogQueries();
      message.success('Custom DAG preview removed');
    } catch {
      message.error('Could not remove preview image');
    }
  };

  useEffect(() => {
    if (open && catalog) {
      form.setFieldsValue({
        name: catalog.name,
        description: catalog.description,
        version: catalog.version,
        tags: catalog.tags,
        is_public: catalog.is_public,
        source_url: catalog.source_url,
      });
    }
  }, [open, catalog, form]);

  const handleOk = async () => {
    if (!catalog?.id) return;
    try {
      const values = await form.validateFields();
      await updateMutation.mutateAsync({
        path: { catalog_ref: catalog.id },
        body: values,
      });

      invalidateCatalogQueries();

      message.success('Catalog metadata updated');
      onSuccess();
    } catch (err) {
      console.error('Failed to update catalog:', err);
    }
  };

  return (
    <Modal
      title="Edit Catalog Metadata"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={updateMutation.isPending}
      width={600}
      okText="Save Changes"
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="Catalog Name"
          rules={[{ required: true, message: 'Please enter a name' }]}
        >
          <Input placeholder="e.g. RNA-Seq Pipeline" />
        </Form.Item>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}
        >
          <Form.Item name="version" label="Version">
            <Input placeholder="e.g. 1.0.0" />
          </Form.Item>
          <Form.Item
            name="is_public"
            label="Visibility"
            valuePropName="checked"
          >
            <Switch checkedChildren="Public" unCheckedChildren="Private" />
          </Form.Item>
        </div>
        <Form.Item name="description" label="Description">
          <Input.TextArea rows={3} placeholder="Brief description" />
        </Form.Item>
        <Form.Item name="tags" label="Tags">
          <Select
            mode="tags"
            style={{ width: '100%' }}
            placeholder="Add tags..."
            tokenSeparators={[',']}
          />
        </Form.Item>
        <Form.Item
          name="source_url"
          label="Source URL"
          extra="Link to GitHub repository or other source"
        >
          <Input placeholder="https://github.com/..." />
        </Form.Item>

        {catalog?.id ? (
          <>
            <Divider orientation="left" plain>
              DAG thumbnail
            </Divider>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              Optional PNG, JPEG, SVG, or WebP stored in Flowo. When cleared,
              the UI falls back to the generated DAG.
            </Typography.Paragraph>
            {catalog.has_dag_preview ? (
              <div
                style={{
                  marginBottom: 12,
                  maxHeight: 160,
                  overflow: 'hidden',
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                  background: '#fafafa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AuthBlobImage
                  src={`/api/v1/catalog/${encodeURIComponent(catalog.id)}/dag/preview`}
                  alt="Current DAG preview"
                  className="max-h-[140px] w-auto object-contain"
                  onStatus={dagPreviewStatusNoop}
                />
              </div>
            ) : null}
            <Space wrap>
              <Tooltip title="Upload PNG, JPEG, SVG, or WebP">
                <Upload
                  accept="image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp"
                  showUploadList={false}
                  customRequest={dagPreviewUploadRequest}
                >
                  <Button icon={<PictureOutlined />}>Upload DAG image</Button>
                </Upload>
              </Tooltip>
              <Button
                icon={<DeleteOutlined />}
                disabled={!catalog.has_dag_preview}
                onClick={() => void clearDagPreview()}
              >
                Clear image
              </Button>
            </Space>
          </>
        ) : null}
      </Form>
    </Modal>
  );
};

export default EditCatalogModal;
