import './App.css';
import { Routes, Route } from 'react-router-dom';
import Home from './Components/home';
import Login from './Components/Login';
import Signup from './Components/Signup';
import ChatsList from './Components/test';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path='/login' element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path='/test' element = {<ChatsList/>} />
      </Routes>
    </div>
  );
}

export default App;
