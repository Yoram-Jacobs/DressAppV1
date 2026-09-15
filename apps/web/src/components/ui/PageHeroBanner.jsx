/**
 * Shared inner-page hero. Photo + dark wash sit on their own layers so RTL
 * (Arabic / Hebrew) can mirror them without flipping the title, subtitle, or CTA.
 */
export function PageHeroBanner({ image, children }) {
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-[1] bg-cover bg-center bg-no-repeat rtl:scale-x-[-1]"
        style={image ? { backgroundImage: `url(${image})` } : undefined}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(90deg,#080b09_0%,#101612_43%,rgba(16,22,18,0.48)_67%,rgba(16,22,18,0.08)_100%)] rtl:scale-x-[-1]"
      />
      {children}
    </section>
  );
}

export default PageHeroBanner;
