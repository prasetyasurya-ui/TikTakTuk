import React from 'react';
import PanelCard from './PanelCard';

const StatCard = ({ label, value, hint = '', valueClassName = 'text-slate-900' }) => (
  <PanelCard className="p-6">
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <h3 className={`text-2xl font-black ${valueClassName}`}>{value}</h3>
    {hint ? <p className="text-[10px] text-slate-400 font-medium mt-2">{hint}</p> : null}
  </PanelCard>
);

export default StatCard;
