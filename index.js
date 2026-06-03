// KETTU COMPATIBLE VERSION - Replace your entire index.js with this

// Kettu imports (different from Vendetta)
const { storage } = require("@kettu/plugin");
const { React, ReactNative, constants } = require("@kettu/metro/common");
const { semanticColors } = require("@kettu/ui");
const { getAssetIDByName } = require("@kettu/ui/assets");
const { Forms } = require("@kettu/ui/components");
const { showToast } = require("@kettu/ui/toasts");
const { findByProps, findByStoreName } = require("@kettu/metro");
const { after, before } = require("@kettu/patcher");
const { clipboard } = require("@kettu/metro/common");

const { FormRow, FormSection, FormInput, FormDivider, FormSwitchRow, FormText } = Forms;
const { ScrollView, View, Text, TouchableOpacity } = ReactNative;

// Kettu's store access
const MessageStore = findByStoreName("MessageStore");
const ChannelStore = findByStoreName("ChannelStore");
const UserStore = findByStoreName("UserStore");

// Initialize storage
storage.targetUserId ??= "";
storage.fromUserId ??= "";
storage.messageContent ??= "";
storage.embedEnabled ??= false;
storage.embedTitle ??= "";
storage.embedDescription ??= "";
storage.embedImageUrl ??= "";

let patches = [];

function createFakeMessage(channelId, authorId, content, embed = null) {
  const author = UserStore.getUser(authorId);
  const timestamp = new Date().toISOString();
  const messageId = `fake-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: messageId,
    channel_id: channelId,
    author: author || {
      id: authorId,
      username: "Unknown User",
      discriminator: "0000",
      avatar: null,
      bot: false,
    },
    content: content,
    timestamp: timestamp,
    edited_timestamp: null,
    tts: false,
    mention_everyone: false,
    mentions: [],
    mention_roles: [],
    attachments: [],
    embeds: embed ? [embed] : [],
    reactions: [],
    pinned: false,
    type: 0,
    flags: 0,
    referenced_message: null,
    _fake: true,
    _kettu: true,  // Kettu-specific flag
  };
}

function injectFakeMessage(channelId, authorId, content, embed = null) {
  try {
    const fakeMessage = createFakeMessage(channelId, authorId, content, embed);
    
    // Kettu's message store injection method
    if (MessageStore && MessageStore._handleMessageCreate) {
      MessageStore._handleMessageCreate(fakeMessage);
    } else if (MessageStore.dispatch) {
      MessageStore.dispatch({
        type: "MESSAGE_CREATE",
        channelId: channelId,
        message: fakeMessage,
      });
    } else {
      // Fallback for Kettu
      const messages = MessageStore.getMessages(channelId);
      if (messages) {
        messages.unshift(fakeMessage);
        MessageStore.emit("messages-updated", channelId);
      }
    }
    
    return true;
  } catch (error) {
    console.error("[MessageFaker] Injection error:", error);
    return false;
  }
}

async function getDMChannel(userId) {
  try {
    const channels = ChannelStore.getSortedPrivateChannels();
    const existingDM = channels.find(channel => 
      channel.type === 1 && channel.recipients && channel.recipients.includes(userId)
    );
    return existingDM?.id || null;
  } catch (error) {
    console.error("[MessageFaker] DM channel error:", error);
    return null;
  }
}

// Settings Component - Kettu compatible
function Settings() {
  const [targetUserId, setTargetUserId] = React.useState(storage.targetUserId || "");
  const [fromUserId, setFromUserId] = React.useState(storage.fromUserId || "");
  const [messageContent, setMessageContent] = React.useState(storage.messageContent || "");
  const [embedEnabled, setEmbedEnabled] = React.useState(storage.embedEnabled || false);
  const [embedTitle, setEmbedTitle] = React.useState(storage.embedTitle || "");
  const [embedDescription, setEmbedDescription] = React.useState(storage.embedDescription || "");
  const [embedImageUrl, setEmbedImageUrl] = React.useState(storage.embedImageUrl || "");

  React.useEffect(() => { storage.targetUserId = targetUserId; }, [targetUserId]);
  React.useEffect(() => { storage.fromUserId = fromUserId; }, [fromUserId]);
  React.useEffect(() => { storage.messageContent = messageContent; }, [messageContent]);
  React.useEffect(() => { storage.embedEnabled = embedEnabled; }, [embedEnabled]);
  React.useEffect(() => { storage.embedTitle = embedTitle; }, [embedTitle]);
  React.useEffect(() => { storage.embedDescription = embedDescription; }, [embedDescription]);
  React.useEffect(() => { storage.embedImageUrl = embedImageUrl; }, [embedImageUrl]);

  const pasteTargetUserId = async () => {
    try {
      const text = await clipboard.getString();
      if (text) {
        setTargetUserId(text.trim());
        showToast("Pasted Target User ID", getAssetIDByName("toast_copy_link"));
      }
    } catch (error) {
      showToast("Failed to paste", getAssetIDByName("Small"));
    }
  };

  const pasteSenderUserId = async () => {
    try {
      const text = await clipboard.getString();
      if (text) {
        setFromUserId(text.trim());
        showToast("Pasted Sender User ID", getAssetIDByName("toast_copy_link"));
      }
    } catch (error) {
      showToast("Failed to paste", getAssetIDByName("Small"));
    }
  };

  const sendFakeMessage = async () => {
    if (!targetUserId || !fromUserId || !messageContent) {
      showToast("Please fill in all required fields", getAssetIDByName("ic_close_16px"));
      return;
    }

    try {
      const channelId = await getDMChannel(targetUserId);
      
      if (!channelId) {
        showToast("DM channel not found. Open a DM with this user first.", getAssetIDByName("ic_close_16px"));
        return;
      }

      let embed = null;
      if (embedEnabled && (embedTitle || embedDescription || embedImageUrl)) {
        embed = {
          type: "rich",
          title: embedTitle || undefined,
          description: embedDescription || undefined,
          image: embedImageUrl ? { url: embedImageUrl } : undefined,
          color: 0x5865F2,
        };
      }

      const success = injectFakeMessage(channelId, fromUserId, messageContent, embed);
      
      if (success) {
        showToast("✅ Fake message injected!", getAssetIDByName("toast_image_saved"));
      } else {
        showToast("Failed to inject", getAssetIDByName("ic_close_16px"));
      }
    } catch (error) {
      showToast("Error: " + error.message, getAssetIDByName("ic_close_16px"));
    }
  };

  const quickTestMessage = async () => {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!currentUserId) {
      showToast("Could not get current user", getAssetIDByName("ic_close_16px"));
      return;
    }
    setTargetUserId(currentUserId);
    setFromUserId(currentUserId);
    setMessageContent("This is a test message from MessageFaker on Kettu!");
    showToast("Test values filled in", getAssetIDByName("toast_image_saved"));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: semanticColors.BACKGROUND_MOBILE_PRIMARY }}>
      <FormSection title="MESSAGE FAKER FOR KETTU">
        <FormRow
          label="Inject fake messages into any DM"
          leading={<FormRow.Icon source={getAssetIDByName("ic_message_edit")} />}
        />
      </FormSection>

      <FormDivider />

      <FormSection title="TARGET USER ID (Whose DM)">
        <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
          User ID of the person whose DM gets the fake message
        </FormText>
        <FormInput
          value={targetUserId}
          onChange={setTargetUserId}
          placeholder="Enter target user ID"
        />
        <TouchableOpacity style={{ backgroundColor: "#5865F2", padding: 15, borderRadius: 8, marginTop: 10, marginHorizontal: 15, alignItems: "center" }} onPress={pasteTargetUserId}>
          <Text style={{ color: "white", fontWeight: "600" }}>📋 Paste Target User ID</Text>
        </TouchableOpacity>
      </FormSection>

      <FormDivider />

      <FormSection title="FROM USER ID (Fake Sender)">
        <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
          User ID of who the message appears to be from
        </FormText>
        <FormInput
          value={fromUserId}
          onChange={setFromUserId}
          placeholder="Enter sender user ID"
        />
        <TouchableOpacity style={{ backgroundColor: "#5865F2", padding: 15, borderRadius: 8, marginTop: 10, marginHorizontal: 15, alignItems: "center" }} onPress={pasteSenderUserId}>
          <Text style={{ color: "white", fontWeight: "600" }}>📋 Paste Sender User ID</Text>
        </TouchableOpacity>
      </FormSection>

      <FormDivider />

      <FormSection title="MESSAGE CONTENT">
        <FormInput
          value={messageContent}
          onChange={setMessageContent}
          placeholder="Enter message content"
        />
      </FormSection>

      <FormDivider />

      <FormSwitchRow
        label="Add Embed (Optional)"
        leading={<FormRow.Icon source={getAssetIDByName("ic_link")} />}
        value={embedEnabled}
        onValueChange={setEmbedEnabled}
      />

      {embedEnabled && (
        <>
          <FormDivider />
          <FormSection title="EMBED TITLE">
            <FormInput value={embedTitle} onChange={setEmbedTitle} placeholder="Embed title" />
          </FormSection>
          <FormSection title="EMBED DESCRIPTION">
            <FormInput value={embedDescription} onChange={setEmbedDescription} placeholder="Embed description" />
          </FormSection>
          <FormSection title="EMBED IMAGE URL">
            <FormInput value={embedImageUrl} onChange={setEmbedImageUrl} placeholder="Image URL" />
          </FormSection>
        </>
      )}

      <FormDivider />

      <View style={{ padding: 15 }}>
        <TouchableOpacity style={{ backgroundColor: "#3BA55D", padding: 15, borderRadius: 8, marginBottom: 10, alignItems: "center" }} onPress={sendFakeMessage}>
          <Text style={{ color: "white", fontWeight: "600" }}>📧 Inject Fake Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={{ backgroundColor: "#F26522", padding: 15, borderRadius: 8, alignItems: "center" }} onPress={quickTestMessage}>
          <Text style={{ color: "white", fontWeight: "600" }}>✏️ Quick Test</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

// Plugin export for Kettu
export default {
  name: "MessageFaker",
  description: "Inject fake messages into any DM from any user",
  authors: [{ name: "xxjust12", id: "0" }],
  onLoad: () => {
    // Expose API to console for advanced users
    globalThis.messageFaker = {
      inject: injectFakeMessage,
      getDMChannel: getDMChannel,
    };
    console.log("[MessageFaker] Loaded on Kettu!");
  },
  onUnload: () => {
    patches.forEach(unpatch => unpatch());
    delete globalThis.messageFaker;
  },
  settings: Settings,
};
