import React from 'react';

export const ProfileField = ({ label, value, capitalize = false }) => (
  <div>
    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</p>
    <p className={`text-sm font-semibold text-slate-900 ${capitalize ? 'capitalize' : ''}`}>{value}</p>
  </div>
);

export const ProfileEditableField = ({
  label,
  value,
  isEditing,
  onChange,
  type = 'text',
  maxLength,
  placeholder = '',
  error = '',
}) => (
  <div>
    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</p>
    {isEditing ? (
      <>
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
            error ? 'border-red-500' : 'border-slate-200'
          }`}
        />
        {error ? <p className="text-red-500 text-xs mt-1">{error}</p> : null}
      </>
    ) : (
      <p className="text-sm font-semibold text-slate-900">{value || '-'}</p>
    )}
  </div>
);

export const ProfilePasswordField = ({ label, value, onChange, error = '' }) => (
  <div>
    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
      {label}
    </label>
    <input
      type="password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
        error ? 'border-red-500' : 'border-slate-200'
      }`}
      required
      maxLength={255}
    />
    {error ? <p className="text-red-500 text-xs mt-1">{error}</p> : null}
  </div>
);
