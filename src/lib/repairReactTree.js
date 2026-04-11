import React from "react";
import { repairUtf8Cp1251Mojibake } from "./textEncoding";

function repairPropValue(value) {
  if (typeof value === "string") {
    return repairUtf8Cp1251Mojibake(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => repairPropValue(item));
  }

  if (value && typeof value === "object" && !React.isValidElement(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, repairPropValue(nestedValue)]));
  }

  return value;
}

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
  const repairedProps = Object.fromEntries(
    Object.entries(node.props)
      .filter(([key]) => key !== "children")
      .map(([key, value]) => [key, repairPropValue(value)])
  );
  const propsChanged = Object.entries(repairedProps).some(([key, value]) => value !== node.props[key]);

  if (repairedChildren === node.props.children && !propsChanged) {
    return node;
  }

  return React.cloneElement(node, { ...node.props, ...repairedProps }, repairedChildren);
}
