import { useEffect } from 'react';

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data);
  useEffect(() => {
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-pinonit-jsonld', '1');
    el.text = json;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [json]);
  return null;
}
