import {useEffect, useRef, useState} from 'react';
import {SlicrIcon} from './SlicrIcon';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faCheck} from '@fortawesome/free-solid-svg-icons';

export type Chapter = {
  id: string;
  title: string;
};

type ChapterSidebarProps = {
  chapters: Chapter[];
  activeChapterId: string;
  onSelectChapter: (chapterId: string) => void;
  onCollapse: () => void;
  onAddChapter?: (title: string) => void | Promise<void>;
};

function CollapseSidebarIcon() {
  return (
    <svg className="collapse-sidebar-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="5" y="5" width="90" height="90" rx="18" ry="18" fill="none" stroke="currentColor" strokeWidth="7" />
      <line x1="32" y1="5" x2="32" y2="95" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <polyline points="68,35 54,50 68,65" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChapterSidebar({chapters, activeChapterId, onSelectChapter, onCollapse, onAddChapter}: ChapterSidebarProps) {
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [chapterTitle, setChapterTitle] = useState('New Chapter');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAddingChapter) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isAddingChapter]);

  const cancelChapterCreation = () => {
    setIsAddingChapter(false);
    setChapterTitle('New Chapter');
  };

  const submitChapterCreation = () => {
    const title = chapterTitle.trim() || 'New Chapter';
    setIsAddingChapter(false);
    setChapterTitle('New Chapter');
    onAddChapter?.(title);
  };

  return (
    <aside className="chapter-sidebar" aria-label="Chapters">
      <div className="chapter-app-header">
        <div className="app-brand">
          <div className="app-brand-mark" aria-hidden="true">
            <SlicrIcon />
          </div>
          <span className="app-brand-name">Slicer</span>
        </div>
        <button type="button" className="sidebar-collapse-button" onClick={onCollapse} aria-label="Collapse sidebar">
          <CollapseSidebarIcon />
        </button>
      </div>
      <div className="chapter-sidebar-header">
        <h2>Chapters</h2>
        <button type="button" className="chapter-sidebar-add" aria-label="Add chapter" onClick={() => setIsAddingChapter(true)}>
          +
        </button>
      </div>
      <nav className="chapter-nav">
        {chapters.map((chapter, index) => {
          const isActive = chapter.id === activeChapterId;
          return (
            <button
              key={chapter.id}
              type="button"
              className={`chapter-nav-item${isActive ? ' chapter-nav-item-active' : ''}`}
              onClick={() => onSelectChapter(chapter.id)}
            >
              <span className="chapter-nav-index">{index + 1}</span>
              <span className="chapter-nav-title">{chapter.title}</span>
            </button>
          );
        })}
      </nav>
      {isAddingChapter ? (
        <div className="chapter-sidebar-create">
          <span className="chapter-nav-index chapter-sidebar-create-index" aria-hidden="true">
            +
          </span>
          <input
            ref={inputRef}
            type="text"
            className="chapter-sidebar-create-input"
            value={chapterTitle}
            onChange={(event) => setChapterTitle(event.target.value)}
            onBlur={cancelChapterCreation}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitChapterCreation();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelChapterCreation();
              }
            }}
          />
          <button
            type="button"
            className="chapter-sidebar-create-confirm"
            aria-label="Create chapter"
            onMouseDown={(event) => event.preventDefault()}
            onClick={submitChapterCreation}
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
        </div>
      ) : null}
    </aside>
  );
}
