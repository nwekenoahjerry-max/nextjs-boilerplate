import type { MouseEventHandler } from "react";

type ClerkMeBrandProps = {
  caption?: string;
  className?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function ClerkMeBrand({ caption, className = "", href = "/", onClick }: ClerkMeBrandProps) {
  return (
    <a className={`brand clerkme-brand ${className}`.trim()} href={href} onClick={onClick} aria-label="ClerkMe home" title="ClerkMe home">
      <img className="clerkme-brand-icon" src="/clerkme-mark.svg" alt="" aria-hidden="true" width={44} height={44} decoding="async"/>
      <span className="clerkme-brand-copy"><strong>ClerkMe</strong>{caption && <small>{caption}</small>}</span>
    </a>
  );
}
