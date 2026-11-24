# Pit Wall privacy policy

Last updated: 24 November 2026

Pit Wall is an Atlassian Forge app. Its code runs on Atlassian's platform and its data sits in Forge storage, which Atlassian hosts. I don't run any server of my own.

## What it reads

- Public timing data from OpenF1 (`api.openf1.org`). The requests carry a season, a meeting number or a session number, nothing about you or your site.
- The list of Jira projects and issue types you can see, when you choose a project or file a finding.
- The ID and address of the Confluence page a debrief sits on.

## What it stores

In Forge storage, inside your site's installation:

- timing data and the debrief for a finished session, kept for 30 days
- the season and session lists, kept for 1 day
- for each page with a debrief: the session, the Jira project key and the page address
- for each finding filed in Jira: the issue key and its address

It doesn't store Atlassian account IDs, names, email addresses or page content.

## What it sends

Nothing leaves your site except the OpenF1 requests above. Jira issues are created in your own Jira, as the person who asked for them.

## The Rovo agent

Rovo chat is run by Atlassian under Atlassian's terms. Pit Wall only receives what its actions ask for: a season, a race, a session, a driver, a stint, a finding ID, a Jira project key and the page ID.

## Questions

Open an issue at https://github.com/OhKazakh/pit-wall/issues.
