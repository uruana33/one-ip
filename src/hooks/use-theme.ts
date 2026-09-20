import {
  applyDocumentTheme,
  themeAtom,
  themeById,
  type Theme,
} from "@/store/theme";
import { useAtom } from "jotai";

export function useTheme() {
  const [theme, updateTheme] = useAtom(themeAtom);
  const scheme = themeById[theme].scheme;
  const setTheme = (next: Theme) => {
    applyDocumentTheme(next);
    updateTheme(next);
  };
  return { theme, setTheme, scheme, resolvedTheme: scheme };
}
