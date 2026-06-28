# Learnings

- Keep graph projection as one pure `projectGraph(events, projectId, chapterId?)` entry point, and let store-backed compatibility wrappers delegate to it so projection behavior stays testable without temporary stores.
