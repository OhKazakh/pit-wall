import { expect, test } from "vitest";
import { pageAddress, positiveInt, projectKey, siteOrigin } from "../src/trust";

test("links stay on the site's own Atlassian address", () => {
  expect(siteOrigin("https://one-atlas-hbvn.atlassian.net")).toBe("https://one-atlas-hbvn.atlassian.net");
  expect(siteOrigin(undefined, "https://pitwall-test.atlassian.net/")).toBe("https://pitwall-test.atlassian.net");
  // Forge's own context wins over what the browser claims.
  expect(siteOrigin("https://one-atlas-hbvn.atlassian.net", "https://evil.example")).toBe("https://one-atlas-hbvn.atlassian.net");
  expect(siteOrigin(undefined, "https://evil.example")).toBe("");
  expect(siteOrigin(undefined, "https://atlassian.net.evil.example")).toBe("");
  expect(siteOrigin(undefined, "javascript:alert(1)")).toBe("");
});

test("a page link needs a numeric page id", () => {
  expect(pageAddress("https://x.atlassian.net", "4718593")).toBe("https://x.atlassian.net/wiki/pages/viewpage.action?pageId=4718593");
  expect(pageAddress("https://x.atlassian.net", "1&next=https://evil.example")).toBe("");
  expect(pageAddress("", "4718593")).toBe("");
});

test("project keys and numbers are checked", () => {
  expect(projectKey("pw")).toBe("PW");
  expect(projectKey("PW<script>")).toBe("");
  expect(positiveInt("9912", "sessionKey")).toBe(9912);
  expect(() => positiveInt(-1, "stint")).toThrow();
  expect(() => positiveInt("1.5", "stint")).toThrow();
  expect(() => positiveInt("abc", "sessionKey")).toThrow();
});
