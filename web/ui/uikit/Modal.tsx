import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export const Modal: React.FC<Props> = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="ui-modal" role="dialog" aria-modal="true">
      <div className="ui-modal-backdrop" onClick={onClose} />
      <div className="ui-modal-content">{children}</div>
    </div>
  );
};
