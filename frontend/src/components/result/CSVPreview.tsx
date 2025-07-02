import { Spin, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import React, { useState } from "react";

// Interfaces for CSV/TSV data
interface TableRowData {
  key: number;
  [key: string]: string | number;
}

interface CSVPreviewProps {
  src: string;
  isFullscreen?: boolean;
}

const parseCSVTSV = (text: string, delimiter: string) => {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return { columns: [], data: [] };

  // Use first line as headers
  const headers = lines[0]
    .split(delimiter)
    .map((header) => header.trim().replace(/^"|"$/g, ""));

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
        .map((value) => value.trim().replace(/^"|"$/g, ""));
      const row: TableRowData = { key: rowIndex };

      values.forEach((value, colIndex) => {
        row[`col_${colIndex}`] = value || "";
      });

      return row;
    })
    .filter((row) => Object.keys(row).length > 1); // Filter out empty rows

  return { columns: tableColumns, data: tableData };
};

// CSV/TSV Preview Component
export const CSVPreview: React.FC<CSVPreviewProps> = ({
  src,
  isFullscreen = false,
}) => {
  const [data, setData] = useState<TableRowData[]>([]);
  const [columns, setColumns] = useState<ColumnsType<TableRowData>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  React.useEffect(() => {
    setLoading(true);
    setError("");

    fetch(src)
      .then((response) => response.text())
      .then((text) => {
        // Determine delimiter based on file extension or content analysis
        const isTSV =
          src.toLowerCase().includes(".tsv") ||
          (text.includes("\t") &&
            text.split("\t").length > text.split(",").length);
        const delimiter = isTSV ? "\t" : ",";

        const { columns: parsedColumns, data: parsedData } = parseCSVTSV(
          text,
          delimiter,
        );

        setColumns(parsedColumns);
        setData(parsedData);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading CSV/TSV file:", error);
        setError("Error loading file content");
        setLoading(false);
      });
  }, [src]);

  if (loading) {
    return <Spin />;
  }

  if (error) {
    return <div style={{ color: "red", padding: "16px" }}>{error}</div>;
  }

  if (data.length === 0) {
    return <div style={{ padding: "16px" }}>No data to display</div>;
  }

  const containerStyle = isFullscreen
    ? { height: "100vh", padding: "24px", overflow: "hidden" }
    : { padding: "16px" };

  const scrollConfig = isFullscreen
    ? { x: "max-content", y: "calc(100vh - 200px)" }
    : { x: "max-content", y: 400 };

  return (
    <div style={containerStyle}>
      <Table
        columns={columns}
        dataSource={data}
        size="small"
        scroll={scrollConfig}
        pagination={{
          pageSize: isFullscreen ? 100 : 50,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `Total ${total} rows`,
        }}
        bordered
      />
    </div>
  );
};

// Fullscreen CSV/TSV Preview Component
export const FullscreenCSVPreview: React.FC<{ src: string }> = ({ src }) => {
  return <CSVPreview src={src} isFullscreen={true} />;
};

export default CSVPreview;
