import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function addMqlListener(mql: MediaQueryList, onChange: () => void) {
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onChange);
    return;
  }

  if (typeof mql.addListener === "function") {
    mql.addListener(onChange);
  }
}

function removeMqlListener(mql: MediaQueryList, onChange: () => void) {
  if (typeof mql.removeEventListener === "function") {
    mql.removeEventListener("change", onChange);
    return;
  }

  if (typeof mql.removeListener === "function") {
    mql.removeListener(onChange);
  }
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    addMqlListener(mql, onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => removeMqlListener(mql, onChange);
  }, []);

  return !!isMobile;
}
