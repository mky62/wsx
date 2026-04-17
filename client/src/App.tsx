import { Route, Routes } from "react-router-dom";
import ChatView from "./pages/ChatView";
import Home from "./pages/Home";
import { useScrollToggle } from "./hooks/useScrollToggle";

function App() {
  useScrollToggle(); // Initialize desktop scroll lock listener

  return (
    <div className="w-full min-h-screen">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rooms/:roomId" element={<ChatView />} />
      </Routes>
    </div>
  );
}

export default App;
