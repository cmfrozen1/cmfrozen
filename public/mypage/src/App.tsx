import Navbar from './components/Navbar';
import Hero from './components/Hero';
import VideoBackground from './components/VideoBackground';

function App() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-white">
      {/* Background Video Layer */}
      <VideoBackground />

      {/* Content Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <Hero />
      </div>
    </main>
  );
}

export default App;
