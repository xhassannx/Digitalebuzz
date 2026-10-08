import type { PanelTemplateModule } from "../types";
import {
  getPanelTemplateDescription,
  getPanelTemplateDisplayName,
} from "@shared/panel-templates";
import { PanelLayout } from "./Layout";
import DefaultIntegrationsPage from "./pages/Integrations";
import DefaultCommercePage from "./pages/Commerce";
import DefaultWaPayPage from "./pages/WaPay";

const template: PanelTemplateModule = {
  meta: {
    id: "default",
    name: getPanelTemplateDisplayName("default"),
    description: getPanelTemplateDescription("default"),
  },
  Layout: PanelLayout,
  pages: {
    Integrations: DefaultIntegrationsPage,
    Commerce: DefaultCommercePage,
    WaPay: DefaultWaPayPage,
  },
};

export default template;
