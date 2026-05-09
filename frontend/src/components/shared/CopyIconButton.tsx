import React from 'react';

import { Button, message, Tooltip } from 'antd';
import { Copy } from 'lucide-react';

import { copyTextToClipboard } from '@/utils/clipboard';

export interface CopyIconButtonProps {
  /** String to copy; if empty after trim, click is a no-op (unless disabled). */
  text: string;
  tooltip?: React.ReactNode;
  /** Shown on success; default includes the copied text. Pass false to suppress. */
  successMessage?: string | false;
  errorMessage?: string;
  className?: string;
  iconSize?: number;
  size?: 'small' | 'middle' | 'large';
  danger?: boolean;
  disabled?: boolean;
  /** Default true so row/card clicks are not triggered. */
  stopPropagation?: boolean;
}

/**
 * Icon-only copy button with LAN-safe clipboard behavior (see @/utils/clipboard).
 */
export const CopyIconButton: React.FC<CopyIconButtonProps> = ({
  text,
  tooltip = 'Copy to clipboard',
  successMessage,
  errorMessage = 'Could not copy to clipboard',
  className,
  iconSize = 14,
  size = 'small',
  danger,
  disabled,
  stopPropagation = true,
}) => {
  const onClick = async (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) {
      message.warning('Nothing to copy');
      return;
    }
    const ok = await copyTextToClipboard(trimmed);
    if (ok) {
      if (successMessage !== false) {
        message.success(
          successMessage === undefined ? `Copied: ${trimmed}` : successMessage,
        );
      }
    } else if (errorMessage) {
      message.error(errorMessage);
    }
  };

  return (
    <Tooltip title={tooltip}>
      <Button
        type="text"
        size={size}
        danger={danger}
        disabled={disabled}
        icon={<Copy size={iconSize} />}
        onClick={(e) => void onClick(e)}
        className={className}
      />
    </Tooltip>
  );
};

export default CopyIconButton;
