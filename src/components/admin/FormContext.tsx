"use client";

import { createContext, useContext } from "react";

export const FormErrorsContext = createContext<Record<string, string>>({});
export const useFieldError = (name: string) => useContext(FormErrorsContext)[name];
