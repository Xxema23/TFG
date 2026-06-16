import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import CapacityModal from "../components/capacity/CapacityModal";

const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/Capacity" element={<CapacityModal />} />
    </Routes>
  );
};

export default AppRouter;