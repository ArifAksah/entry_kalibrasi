
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: React.ReactNode;
}

const commonLabelClasses = "block text-sm font-medium text-gray-700 mb-1";
const commonInputClasses = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";

export const Input: React.FC<InputProps> = ({ label, id, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className={commonLabelClasses}>{label}</label>
      <input id={id} {...props} className={`${commonInputClasses} ${props.className}`} />
    </div>
  );
};

export const Textarea: React.FC<TextareaProps> = ({ label, id, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className={commonLabelClasses}>{label}</label>
      <textarea id={id} {...props} className={`${commonInputClasses} ${props.className}`} />
    </div>
  );
};

export const Select: React.FC<SelectProps> = ({ label, id, children, ...props }) => {
  return (
    <div>
      <label htmlFor={id} className={commonLabelClasses}>{label}</label>
      <select id={id} {...props} className={`${commonInputClasses} ${props.className}`}>
        {children}
      </select>
    </div>
  );
};
