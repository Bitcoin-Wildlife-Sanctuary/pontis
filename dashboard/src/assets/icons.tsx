type SVGProps = React.SVGProps<SVGSVGElement>;

export const ExternalLink: React.FC<SVGProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

export const ChevronRight: React.FC<SVGProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

export const DoubleArrowRight: React.FC<SVGProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 50" fill="none" {...props}>
    <path
      d="M12.0627 25.1225L11.0627 25.1225L11.0627 26.1225L12.0627 26.1225L12.0627 25.1225ZM26.7698 25.8296C27.1604 25.439 27.1604 24.8059 26.7698 24.4154L20.4059 18.0514C20.0153 17.6609 19.3822 17.6609 18.9917 18.0514C18.6011 18.4419 18.6011 19.0751 18.9917 19.4656L24.6485 25.1225L18.9917 30.7793C18.6011 31.1699 18.6011 31.803 18.9917 32.1935C19.3822 32.5841 20.0153 32.5841 20.4059 32.1935L26.7698 25.8296ZM12.0627 1.49991L13.0627 1.49991L13.0627 0.499911L12.0627 0.499909L12.0627 1.49991ZM12.0627 26.1225L26.0627 26.1225L26.0627 24.1225L12.0627 24.1225L12.0627 26.1225ZM-2.67482e-06 2.49988L12.0627 2.49991L12.0627 0.499909L2.78202e-06 0.499876L-2.67482e-06 2.49988ZM11.0627 1.49991L11.0627 25.1225L13.0627 25.1225L13.0627 1.49991L11.0627 1.49991Z"
      fill="currentColor"
    />
    <path
      d="M12.064 25.124L11.064 25.124L11.064 24.124L12.064 24.124L12.064 25.124ZM26.7711 24.4169C27.1616 24.8074 27.1616 25.4406 26.7711 25.8311L20.4071 32.1951C20.0166 32.5856 19.3834 32.5856 18.9929 32.1951C18.6024 31.8045 18.6024 31.1714 18.9929 30.7808L24.6498 25.124L18.9929 19.4671C18.6024 19.0766 18.6024 18.4434 18.9929 18.0529C19.3834 17.6624 20.0166 17.6624 20.4071 18.0529L26.7711 24.4169ZM12.064 48.7466L13.064 48.7466L13.064 49.7465L12.064 49.7466L12.064 48.7466ZM12.064 24.124L26.064 24.124L26.064 26.124L12.064 26.124L12.064 24.124ZM0.00124855 47.7466L12.064 47.7466L12.064 49.7466L0.001254 49.7466L0.00124855 47.7466ZM11.064 48.7466L11.064 25.124L13.064 25.124L13.064 48.7466L11.064 48.7466Z"
      fill="currentColor"
    />
  </svg>
);

export const ArrowDown: React.FC<SVGProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <polyline points="19 12 12 19 5 12"></polyline>
  </svg>
);

export const AlertTriangle: React.FC<SVGProps> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);
