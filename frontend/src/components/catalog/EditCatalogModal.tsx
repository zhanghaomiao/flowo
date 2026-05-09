import React, { useEffect } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Form, Input, message, Modal, Select, Switch } from 'antd';

import {
  getCatalogQueryKey,
  listCatalogsQueryKey,
  updateCatalogMutation,
} from '@/client/@tanstack/react-query.gen';
import type { CatalogDetail, CatalogSummary } from '@/client/types.gen';

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
    if (!catalog?.slug) return;
    try {
      const values = await form.validateFields();
      await updateMutation.mutateAsync({
        path: { slug: catalog.slug },
        body: values,
      });

      // Invalidate both list and specific detail queries
      queryClient.invalidateQueries({ queryKey: listCatalogsQueryKey({}) });
      queryClient.invalidateQueries({
        queryKey: getCatalogQueryKey({ path: { slug: catalog.slug } }),
      });

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
      </Form>
    </Modal>
  );
};

export default EditCatalogModal;
