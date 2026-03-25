import React from 'react';

export const StarIcon: React.FC<React.SVGProps<SVGSVGElement> & { title?: string }> = ({ title, ...props }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 20 20" 
    fill="currentColor" 
    {...props}
  >
    {title && <title>{title}</title>}
    <path 
      fillRule="evenodd" 
      d="M10.868 2.884c.321-.662 1.215-.662 1.536 0l1.681 3.46c.154.316.46.533.805.576l3.82.555c.703.102.984.966.474 1.457l-2.764 2.694a.972.972 0 00-.282.857l.653 3.803c.12.702-.615 1.235-1.244.91l-3.414-1.795a.972.972 0 00-.908 0l-3.414 1.795c-.63.325-1.364-.208-1.244-.91l.653-3.803a.972.972 0 00-.282-.857L2.49 8.932c-.51-.491-.229-1.355.474-1.457l3.82-.555a.972.972 0 00.805-.576l1.681-3.46z" 
      clipRule="evenodd" 
    />
  </svg>
);