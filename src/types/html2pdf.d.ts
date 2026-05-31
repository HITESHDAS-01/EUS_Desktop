declare module 'html2pdf.js' {
  const html2pdf: {
    (): {
      set(opts: Record<string, unknown>): {
        from(element: HTMLElement | string): {
          save(): Promise<void>;
        };
      };
    };
  };
  export default html2pdf;
}
