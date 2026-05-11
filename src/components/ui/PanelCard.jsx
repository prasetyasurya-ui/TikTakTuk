import React from 'react';

const PanelCard = ({ as: Tag = 'section', className = '', children }) => {
  return (
    <Tag className={`bg-white rounded-3xl border border-slate-200 shadow-sm ${className}`.trim()}>
      {children}
    </Tag>
  );
};

export default PanelCard;
