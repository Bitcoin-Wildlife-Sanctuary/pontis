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
  <svg xmlns="http://www.w3.org/2000/svg" width="33" height="87" viewBox="0 0 33 87" fill="none" {...props}>
    <path
      d="M17.1252 43.8026L16.1252 43.8026L16.1252 44.8026L17.1252 44.8026L17.1252 43.8026ZM31.8323 44.5097C32.2228 44.1192 32.2228 43.486 31.8323 43.0955L25.4684 36.7315C25.0778 36.341 24.4447 36.341 24.0541 36.7315C23.6636 37.122 23.6636 37.7552 24.0541 38.1457L29.711 43.8026L24.0541 49.4594C23.6636 49.85 23.6636 50.4831 24.0541 50.8736C24.4447 51.2642 25.0778 51.2642 25.4684 50.8736L31.8323 44.5097ZM17.1252 1.80255L18.1252 1.80255L18.1252 0.80255L17.1252 0.802551L17.1252 1.80255ZM17.1252 44.8026L31.1252 44.8026L31.1252 42.8026L17.1252 42.8026L17.1252 44.8026ZM0.125215 2.80258L17.1252 2.80255L17.1252 0.802551L0.125211 0.802577L0.125215 2.80258ZM16.1252 1.80255L16.1252 43.8026L18.1252 43.8026L18.1252 1.80255L16.1252 1.80255Z"
      fill="currentColor"
    />
    <path
      d="M17.1256 43.8117L16.1256 43.8117L16.1256 42.8117L17.1256 42.8117L17.1256 43.8117ZM31.8327 43.1046C32.2232 43.4952 32.2232 44.1283 31.8327 44.5188L25.4687 50.8828C25.0782 51.2733 24.445 51.2733 24.0545 50.8828C23.664 50.4923 23.664 49.8591 24.0545 49.4686L29.7114 43.8117L24.0545 38.1549C23.664 37.7644 23.664 37.1312 24.0545 36.7407C24.445 36.3501 25.0782 36.3501 25.4687 36.7407L31.8327 43.1046ZM17.1256 85.8118L18.1256 85.8118L18.1256 86.8118L17.1256 86.8118L17.1256 85.8118ZM17.1256 42.8117L31.1256 42.8117L31.1256 44.8117L17.1256 44.8117L17.1256 42.8117ZM0.125581 84.8117L17.1256 84.8118L17.1256 86.8118L0.125578 86.8117L0.125581 84.8117ZM16.1256 85.8118L16.1256 43.8117L18.1256 43.8117L18.1256 85.8118L16.1256 85.8118Z"
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
