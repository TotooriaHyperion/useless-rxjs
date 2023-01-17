import { Tabs } from "antd";
import "./App.css";
import { Example1 } from "./example_1/view";

function App() {
  return (
    <Tabs
      items={[
        {
          key: "Example1",
          label: "Example1",
          children: <Example1 />,
        },
      ]}
    />
  );
}

export default App;
