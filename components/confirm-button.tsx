'use client';
export function ConfirmButton({message,children,...props}:React.ComponentProps<'button'>&{message:string}) {
  return <button {...props} onClick={event=>{if(!window.confirm(message))event.preventDefault();}}>{children}</button>;
}