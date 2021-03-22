## endpoints

LiveChat DOM = https://www.youtube.com/live_chat?continuation=<continuation>
LiveChat API = https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=<innertubeApiKey>

## selecting chat server

```
.continuationContents.liveChatContinuation.header.liveChatHeaderRenderer.viewSelector.sortFilterSubMenuRenderer.subMenuItems[].continuation.reloadContinuationData
```

## rawMessages

### navigationEndpoint

```json
[
  {
    "text": "https://www.youtube.com/watch?v=KpSLi...",
    "navigationEndpoint": {
      "watchEndpoint": { "nofollow": true, "videoId": "<videoid>" },
      "commandMetadata": {
        "webCommandMetadata": {
          "url": "/watch?v=<videoid>",
          "rootVe": 3832,
          "webPageType": "WEB_PAGE_TYPE_WATCH"
        }
      }
    }
  }
]
```

### custom emojis

```json
{
  "emoji": {
    "emojiId": "UCl_gCybOJRIgOXw6Qb4qJzQ/fAlGX-fwIMOf-gOkv4awAQ",
    "shortcuts": [":_どんっ:", ":どんっ:"],
    "searchTerms": ["_どんっ", "どんっ"],
    "image": {
      "thumbnails": [
        {
          "url": "https://yt3.ggpht.com/gswO_3qhpixDRwBdyzXAIptM_Q52F6kQj44OZHwZCTJPcO4pUFABjhvxMw9RhHWGGdYt7j_6JzI=w24-h24-c-k-nd",
          "width": 24,
          "height": 24
        },
        {
          "url": "https://yt3.ggpht.com/gswO_3qhpixDRwBdyzXAIptM_Q52F6kQj44OZHwZCTJPcO4pUFABjhvxMw9RhHWGGdYt7j_6JzI=w48-h48-c-k-nd",
          "width": 48,
          "height": 48
        }
      ],
      "accessibility": { "accessibilityData": { "label": "どんっ" } }
    },
    "isCustomEmoji": True
  }
}
```

## authorBadges

- Membership `customThumbnail`
- VERIFIED
- OWNER
- MODERATOR

## authorExternalChannelId

Author channel id

## markChatItemAsDeletedAction

Message deleted by OP or Moderator.

```json
{
  "deletedStateMessage": {
    "runs": [
      {
        "text": "[message retracted]", // deleted by original author
        "text": "[message deleted]" // deleted by moderator
      }
    ]
  },
  "targetItemId": "CkUKGkNNaURyYS0yN3UwQ0ZYd3FyUVlkblZjUGZnEidDTWpHdmVpeDd1MENGUnI1V0FvZDFsUURLZzE2MDkwODExNDEzNTk%3D"
}
```

## liveChatTickerSponsorItemRenderer

New Membership

## markChatItemsByAuthorAsDeletedAction

Mark as banned by YouTube system? all messages from `externalChannelId` should be deleted.

```json
{
  "markChatItemsByAuthorAsDeletedAction": {
    "deletedStateMessage": {
      "runs": [
        {
          "text": "[message deleted]"
        }
      ]
    },
    "externalChannelId": "<channelid>"
  }
}
```

## liveChatPlaceholderItemRenderer

placeholder for the message being censored? NG word?

## replaceChatItemAction

insert accepted message into the placeholder?

```json
{
  "targetItemId": "<chaid>",
  "replacementItem": {
    "liveChatTextMessageRenderer": {
      "message": {
        "runs": [
          {
            "text": "まちこい"
          }
        ]
      },
      "authorName": {
        "simpleText": "のへちん"
      },
      "id": "<chaid>",
      "timestampUsec": "1609082482718809",
      "authorExternalChannelId": "<channelid>"
    }
  }
}``
```

# live chat custom CSS for OBS

```css
body {
  background-color: rgba(0, 0, 0, 0) !important;
  margin: 0px auto;
  overflow: hidden !important;
}
html {
  --yt-spec-general-background-a: rgba(0, 0, 0, 0) !important;
  --yt-spec-brand-background-primary: rgba(0, 0, 0, 0) !important;
  --yt-live-chat-primary-text-color: white !important;
}
yt-live-chat-header-renderer,
#panel-pages,
yt-live-chat-author-chip {
  display: none !important;
}
#item-scroller {
  overflow: hidden !important;
}
```
