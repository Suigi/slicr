import { useEffect, useRef, useState } from 'react';

type NodeSearchOption<T> = {
  id: string;
  primary: string;
  secondary: string;
  colorClassName?: string;
  value: T;
};

type NodeSearchComboboxProps<T> = {
  inputId: string;
  inputClassName: string;
  pickerClassName: string;
  suggestionsClassName: string;
  itemClassName: string;
  activeClassName: string;
  emptyClassName: string;
  primaryClassName: string;
  secondaryClassName: string;
  placeholder: string;
  options: Array<NodeSearchOption<T>>;
  query: string;
  onQueryChange: (value: string) => void;
  onPick: (option: NodeSearchOption<T>) => void;
  onEscape?: () => void;
  selectAllOnFocus?: boolean;
  autoFocus?: boolean;
};

export function NodeSearchCombobox<T>(props: NodeSearchComboboxProps<T>) {
  const {
    inputId,
    inputClassName,
    pickerClassName,
    suggestionsClassName,
    itemClassName,
    activeClassName,
    emptyClassName,
    primaryClassName,
    secondaryClassName,
    placeholder,
    options,
    query,
    onQueryChange,
    onPick,
    onEscape,
    selectAllOnFocus,
    autoFocus
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hideUntilInput, setHideUntilInput] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const showSuggestions = hasFocus && !hideUntilInput;

  const scrollActiveIntoView = () => {
    if (!suggestionsRef.current) return;
    const active = suggestionsRef.current.querySelector(`.${activeClassName}`);
    if (active) {
      (active as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  };

  const pickByIndex = (index: number) => {
    const picked = options[index];
    if (!picked) return;
    onPick(picked);
    onQueryChange('');
    setActiveIndex(-1);
    setHideUntilInput(true);
  };

  useEffect(() => {
    if (!autoFocus) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [autoFocus]);

  return (
    <div className={pickerClassName}>
      <input
        ref={inputRef}
        id={inputId}
        className={inputClassName}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setActiveIndex(-1);
          setHideUntilInput(false);
        }}
        onFocus={(event) => {
          setHasFocus(true);
          if (selectAllOnFocus) {
            event.currentTarget.setSelectionRange(0, event.currentTarget.value.length);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setHasFocus(false);
            setActiveIndex(-1);
          }, 60);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            if (hideUntilInput || options.length === 0) return;
            event.preventDefault();
            setActiveIndex((current) => {
              const next = (current + 1 + options.length) % options.length;
              window.setTimeout(scrollActiveIntoView, 0);
              return next;
            });
            return;
          }
          if (event.key === 'ArrowUp') {
            if (hideUntilInput || options.length === 0) return;
            event.preventDefault();
            setActiveIndex((current) => {
              if (current < 0) {
                window.setTimeout(scrollActiveIntoView, 0);
                return options.length - 1;
              }
              const next = (current - 1 + options.length) % options.length;
              window.setTimeout(scrollActiveIntoView, 0);
              return next;
            });
            return;
          }
          if (event.key === 'Enter') {
            if (hideUntilInput || options.length === 0) return;
            event.preventDefault();
            pickByIndex(activeIndex >= 0 ? activeIndex : 0);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            onEscape?.();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      <div
        ref={suggestionsRef}
        className={suggestionsClassName}
        style={{ display: showSuggestions ? 'block' : 'none' }}
      >
        {options.length === 0 ? (
          <div className={emptyClassName}>No suggestions.</div>
        ) : (
          options.map((option, index) => {
            const active = index === activeIndex ? activeClassName : '';
            return (
              <button
                key={option.id}
                type="button"
                className={`${itemClassName} ${active}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pickByIndex(index);
                }}
              >
                <div className={`${primaryClassName} ${option.colorClassName ?? ''}`}>{option.primary}</div>
                <div className={`${secondaryClassName} ${option.colorClassName ?? ''}`}>{option.secondary}</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export type { NodeSearchOption };
