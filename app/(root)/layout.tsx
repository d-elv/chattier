import SidebarWrapper from "@/components/shared/sidebar/SidebarWrapper";
import React from "react";

type Props = React.PropsWithChildren<Record<string, unknown>>;

export default function Layout({ children }: Props) {
  return <SidebarWrapper>{children}</SidebarWrapper>;
}
