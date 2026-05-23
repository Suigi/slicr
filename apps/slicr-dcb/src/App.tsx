import { InfiniteCanvas } from '@slicr/react-ui';

export function App() {
  return (
    <InfiniteCanvas className="canvas" controls={{ toolbar: true }}>
      <div className="hello-box">hello world</div>
    </InfiniteCanvas>
  );
}
