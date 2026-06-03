import { useEffect, useRef, type AnchorHTMLAttributes, type HTMLAttributes } from 'react';

import '../card-tags/pointy-card-tags.js';

export type PointyCardTagClickDetail = {
  text: string | null;
  href: string | null;
  originalEvent: MouseEvent;
};

export type PointyCardTagClickEvent = CustomEvent<PointyCardTagClickDetail>;

export type PointyCardTag = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
  label: string;
  href: string;
};

export type PointyCardTagsElement = HTMLElement;

type PointyCardTagsCustomElementProps = Omit<HTMLAttributes<PointyCardTagsElement>, 'children' | 'onClick'> & {
  children?: React.ReactNode;
  'aria-label'?: string;
  ref?: React.Ref<PointyCardTagsElement>;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'pointy-card-tags': PointyCardTagsCustomElementProps;
    }
  }
}

export type PointyCardTagsProps = Omit<HTMLAttributes<PointyCardTagsElement>, 'children' | 'onClick'> & {
  tags: readonly PointyCardTag[];
  ariaLabel?: string;
  onTagClick?: (event: PointyCardTagClickEvent) => void;
};

export function PointyCardTags({
  tags,
  ariaLabel = 'Card tags',
  onTagClick,
  ...elementProps
}: PointyCardTagsProps) {
  const elementRef = useRef<PointyCardTagsElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !onTagClick) return;

    const handleTagClick = (event: Event) => {
      onTagClick(event as PointyCardTagClickEvent);
    };

    element.addEventListener('tag-click', handleTagClick);

    return () => {
      element.removeEventListener('tag-click', handleTagClick);
    };
  }, [onTagClick]);

  return (
    <pointy-card-tags {...elementProps} ref={elementRef} aria-label={ariaLabel}>
      {tags.map(({ label, ...anchorProps }, index) => (
        <a key={`${anchorProps.href}-${label}-${index}`} {...anchorProps}>
          {label}
        </a>
      ))}
    </pointy-card-tags>
  );
}
