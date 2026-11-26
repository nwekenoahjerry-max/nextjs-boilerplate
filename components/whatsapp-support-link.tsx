type WhatsAppSupportLinkProps = {
  className?: string;
};

export default function WhatsAppSupportLink({ className = "" }: WhatsAppSupportLinkProps) {
  return (
    <a
      className={`you-setting-action clerkme-support-setting ${className}`.trim()}
      href="https://wa.me/2349047324936"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact ClerkMe support on WhatsApp"
      title="WhatsApp support"
    >
      <span className="account-settings-row-icon clerkme-support-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="currentColor" focusable="false">
          <path d="M16 2.3A13.55 13.55 0 0 0 4.34 22.76L2.5 29.5l6.9-1.8A13.55 13.55 0 1 0 16 2.3Zm0 24.63c-2.04 0-4.04-.55-5.78-1.6l-.42-.25-4.1 1.07 1.1-4-.28-.43A11.23 11.23 0 1 1 16 26.93Z"/>
          <path d="M22.2 18.27c-.34-.17-1.97-.97-2.28-1.08-.31-.11-.53-.17-.75.17-.23.34-.87 1.08-1.06 1.3-.19.22-.39.25-.73.08-.34-.17-1.44-.53-2.74-1.69-1.01-.9-1.69-2.02-1.89-2.36-.2-.34-.02-.53.15-.7.15-.15.34-.39.5-.58.17-.2.22-.34.34-.56.11-.22.05-.42-.03-.59-.08-.17-.75-1.8-1.03-2.46-.27-.64-.55-.55-.75-.56l-.64-.01c-.22 0-.58.08-.89.42-.31.34-1.17 1.14-1.17 2.78s1.2 3.22 1.36 3.44c.17.22 2.36 3.6 5.72 5.04.8.35 1.42.56 1.9.71.8.25 1.53.22 2.11.13.64-.1 1.97-.81 2.25-1.59.28-.78.28-1.44.2-1.58-.08-.14-.31-.22-.65-.39Z"/>
        </svg>
      </span>
      <span>
        <strong>WhatsApp support</strong>
        <small>Get help with your account or using ClerkMe.</small>
      </span>
      <span className="you-action-label">Contact support <b aria-hidden="true">→</b></span>
    </a>
  );
}
