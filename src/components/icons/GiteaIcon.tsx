
import React from 'react';

export const GiteaIcon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }> = ({ title, ...props }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    {...props}
  >
    {title && <title>{title}</title>}
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1.2 14.2h-3v-1.2h1.8v-3.6h-1.8v-1.2h3.2v6z" fill="#34A853"/>
  </svg>
);
