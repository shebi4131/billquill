import type { InputHTMLAttributes, ReactNode } from 'react';
export function Field({label,children,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string;children?:ReactNode}) {
  return <label className="field"><span>{label}</span>{children || <input {...props}/>}</label>;
}