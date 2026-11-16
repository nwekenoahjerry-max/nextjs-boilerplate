import type { MouseEventHandler } from "react";

type ClerkMeBrandProps = {
  caption?: string;
  className?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export default function ClerkMeBrand({ caption, className = "", href = "/", onClick }: ClerkMeBrandProps) {
  return (
    <a className={`brand clerkme-brand ${className}`.trim()} href={href} onClick={onClick} aria-label="ClerkME home">
      <img className="clerkme-brand-icon" src="/clerkme-icon.svg" alt="" aria-hidden="true"/>
      <span className="clerkme-brand-copy"><strong>Clerk<span>ME</span></strong>{caption && <small>{caption}</small>}</span>
    </a>
  );
}
