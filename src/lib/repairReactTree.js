import React from "react";
import { repairUtf8Cp1251Mojibake } from "./textEncoding";

export function repairReactTextTree(node) {
  if (typeof node === "string") {
    return repairUtf8Cp1251Mojibake(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => repairReactTextTree(item));
  }

  if (!React.isValidElement(node)) {
    return node;
  }

  const repairedChildren = repairReactTextTree(node.props.children);
  if (repairedChildren === node.props.children) {
    return node;
  }

  return React.cloneElement(node, { ...node.props }, repairedChildren);
}
