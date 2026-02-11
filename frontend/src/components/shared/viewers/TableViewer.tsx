import React, { useState } from 'react';

import { Spin, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import type { FileViewerProps } from './types';

// Interfaces for table data
interface TableRowData {
  key: number;
  [key: string]: string | number;
}

const parseCSVTSV = (text: string, delimiter: string) => {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return { columns: [], data: [] };

  // Use first line as headers
  const headers = lines[0]
    .split(delimiter)
    .map((header) => header.trim().replace(/^"|"$/g, ''));

  // Create columns for Ant Design Table
  const tableColumns: ColumnsType<TableRowData> = headers.map(
    (header, index) => ({
      title: header || `Column ${index + 1}`,
      dataIndex: `col_${index}`,
      key: `col_${index}`,
      ellipsis: true,
      width: 150,
    }),
  );

  // Parse data rows
  const tableData = lines
    .slice(1)
    .map((line, rowIndex) => {
      const values = line
        .split(delimiter)
        .map((value) => value.trim().replace(/^"|"$/g, ''));
      const row: TableRowData = { key: rowIndex };

      values.forEach((value, colIndex) => {
        row[`col_${colIndex}`] = value || '';
      });

      return row;
    })
    .filter((row) => Object.keys(row).length > 1); // Filter out empty rows

  return { columns: tableColumns, data: tableData };
};

export const TableViewer: React.FC<FileViewerProps> = ({
  src,
  content,
  fullscreen = false,
}) => {
  const [data, setData] = useState<TableRowData[]>([]);
  const [columns, setColumns] = useState<ColumnsType<TableRowData>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  React.useEffect(() => {
    setLoading(true);
    setError('');

    const loadData = async () => {
      try {
        let text: string;
        if (content) {
          text = content;
        } else if (src) {
          const response = await fetch(src);
          text = await response.text();
        } else {
          throw new Error('No content or src provided');
        }

        // Determine delimiter based on file extension or content analysis
        const isTSV =
          (src && src.toLowerCase().includes('.tsv')) ||
          (text.includes('\t') &&
            text.split('\t').length > text.split(',').length);
        const delimiter = isTSV ? '\t' : ',';

        const { columns: parsedColumns, data: parsedData } = parseCSVTSV(
          text,
          delimiter,
        );

        setColumns(parsedColumns);
        setData(parsedData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading table data:', error);
        setError('Error loading file content');
        setLoading(false);
      }
    };

    loadData();
  }, [src, content]);

  if (loading) {
    return <Spin />;
  }

  if (error) {
    return <div style={{ color: 'red', padding: '16px' }}>{error}</div>;
  }

  if (data.length === 0) {
    return <div style={{ padding: '16px' }}>No data to display</div>;
  }

  const containerStyle = fullscreen
    ? { height: 'calc(100vh - 250px)', padding: '24px', overflow: 'hidden' }
    : { padding: '16px' };

  const scrollConfig = fullscreen
    ? { x: 'max-content', y: 'calc(100vh - 320px)' }
    : { x: 'max-content', y: 500 };

  return (
    <div style={containerStyle}>
      <Table
        columns={columns}
        dataSource={data}
        size="small"
        scroll={scrollConfig}
        pagination={{
          pageSize: fullscreen ? 100 : 50,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `Total ${total} rows`,
        }}
        bordered
      />
    </div>
  );
};
