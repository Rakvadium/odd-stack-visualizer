import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProtoProvider } from "./proto/ctx";
import { ProtoApp } from "./proto/ProtoApp";
import "./proto/proto.css";
import { stack } from "./sources";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ProtoProvider stack={stack}>
      <ProtoApp />
    </ProtoProvider>
  </StrictMode>,
);
