import { storage } from "@vendetta/plugin";
import { React, ReactNative as RN, constants } from "@vendetta/metro/common";
import { semanticColors } from "@vendetta/ui";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Forms } from "@vendetta/ui/components";
import { showToast } from "@vendetta/ui/toasts";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { clipboard } from "@vendetta/metro/common";

const { FormRow, FormSection, FormInput, FormDivider, FormSwitchRow, FormText } = Forms;
const { ScrollView, View, Text, TouchableOpacity } = RN;

// Get Discord modules
const MessageStore = findByStoreName("MessageStore");
const ChannelStore = findByStoreName("ChannelStore");
const UserStore = findByStoreName("UserStore");
const SelectedChannelStore = findByStoreName("SelectedChannelStore");

// Initialize storage with default values
storage.targetUserId ??= "";
storage.fromUserId ??= "";
storage.messageContent ??= "";
storage.embedEnabled ??= false;
storage.embedTitle ??= "";
storage.embedDescription ??= "";
storage.embedImageUrl ??= "";

let patches = [];

// Function to create a fake message object
function createFakeMessage(channelId, authorId, content, embed = null) {
  const author = UserStore.getUser(authorId);
  const timestamp = new Date().toISOString();
  const messageId = `fake-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const fakeMessage = {
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
    // Client-side flag to identify fake messages
    _fake: true,
  };
  
  return fakeMessage;
}

// Function to inject fake message into the message store
function injectFakeMessage(channelId, authorId, content, embed = null) {
  try {
    const fakeMessage = createFakeMessage(channelId, authorId, content, embed);
    
    // Get the MessageStore's internal cache
    const messageCache = MessageStore._dispatcher._actionHandlers._orderedActionHandlers.MESSAGE_CREATE;
    
    // Dispatch a fake MESSAGE_CREATE event
    if (MessageStore._dispatcher) {
      MessageStore._dispatcher.dispatch({
        type: "MESSAGE_CREATE",
        channelId: channelId,
        message: fakeMessage,
        optimistic: false,
        sendMessageOptions: {},
        isPushNotification: false,
      });
    }
    
    return true;
  } catch (error) {
    console.error("Error injecting fake message:", error);
    return false;
  }
}

// Function to get or create a DM channel with a user
async function getDMChannel(userId) {
  try {
    // Try to find existing DM channel
    const channels = ChannelStore.getSortedPrivateChannels();
    const existingDM = channels.find(channel => 
      channel.type === 1 && channel.recipients && channel.recipients.includes(userId)
    );
    
    if (existingDM) {
      return existingDM.id;
    }
    
    // If no DM exists, we'll need to create one or use an existing channel ID
    // For now, we'll return null and handle it in the UI
    return null;
  } catch (error) {
    console.error("Error getting DM channel:", error);
    return null;
  }
}

// Settings component
function Settings() {
  const [targetUserId, setTargetUserId] = React.useState(storage.targetUserId || "");
  const [fromUserId, setFromUserId] = React.useState(storage.fromUserId || "");
  const [messageContent, setMessageContent] = React.useState(storage.messageContent || "");
  const [embedEnabled, setEmbedEnabled] = React.useState(storage.embedEnabled || false);
  const [embedTitle, setEmbedTitle] = React.useState(storage.embedTitle || "");
  const [embedDescription, setEmbedDescription] = React.useState(storage.embedDescription || "");
  const [embedImageUrl, setEmbedImageUrl] = React.useState(storage.embedImageUrl || "");

  // Save to storage whenever values change
  React.useEffect(() => {
    storage.targetUserId = targetUserId;
  }, [targetUserId]);

  React.useEffect(() => {
    storage.fromUserId = fromUserId;
  }, [fromUserId]);

  React.useEffect(() => {
    storage.messageContent = messageContent;
  }, [messageContent]);

  React.useEffect(() => {
    storage.embedEnabled = embedEnabled;
  }, [embedEnabled]);

  React.useEffect(() => {
    storage.embedTitle = embedTitle;
  }, [embedTitle]);

  React.useEffect(() => {
    storage.embedDescription = embedDescription;
  }, [embedDescription]);

  React.useEffect(() => {
    storage.embedImageUrl = embedImageUrl;
  }, [embedImageUrl]);

  const pasteTargetUserId = async () => {
    try {
      const text = await clipboard.getString();
      if (text) {
        setTargetUserId(text.trim());
        showToast("Pasted Target User ID", getAssetIDByName("toast_copy_link"));
      }
    } catch (error) {
      showToast("Failed to paste from clipboard", getAssetIDByName("Small"));
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
      showToast("Failed to paste from clipboard", getAssetIDByName("Small"));
    }
  };

  const sendFakeMessage = async () => {
    if (!targetUserId || !fromUserId || !messageContent) {
      showToast("Please fill in all required fields", getAssetIDByName("ic_close_16px"));
      return;
    }

    try {
      // Get the DM channel with the target user
      const channelId = await getDMChannel(targetUserId);
      
      if (!channelId) {
        showToast("Could not find DM channel. Try opening a DM with this user first.", getAssetIDByName("ic_close_16px"));
        return;
      }

      // Create embed object if enabled
      let embed = null;
      if (embedEnabled && (embedTitle || embedDescription || embedImageUrl)) {
        embed = {
          type: "rich",
          title: embedTitle || undefined,
          description: embedDescription || undefined,
          image: embedImageUrl ? { url: embedImageUrl } : undefined,
          color: 0x5865F2, // Discord blurple color
        };
      }

      // Inject the fake message
      const success = injectFakeMessage(channelId, fromUserId, messageContent, embed);
      
      if (success) {
        showToast("✅ Fake message sent!", getAssetIDByName("toast_image_saved"));
      } else {
        showToast("Failed to send fake message", getAssetIDByName("ic_close_16px"));
      }
    } catch (error) {
      console.error("Error sending fake message:", error);
      showToast("Error: " + error.message, getAssetIDByName("ic_close_16px"));
    }
  };

  const quickTestMessage = async () => {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!currentUserId) {
      showToast("Could not get current user", getAssetIDByName("ic_close_16px"));
      return;
    }

    // Set test values
    setTargetUserId(currentUserId);
    setFromUserId(currentUserId);
    setMessageContent("This is a test message!");
    
    showToast("Test values filled in", getAssetIDByName("toast_image_saved"));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: semanticColors.BACKGROUND_MOBILE_PRIMARY }}>
      {/* MESSAGE FAKER Section */}
      <FormSection title="MESSAGE FAKER">
        <FormRow
          label="Inject fake messages into DMs from anyone."
          leading={<FormRow.Icon source={getAssetIDByName("ic_message_edit")} />}
        />
      </FormSection>

      <FormDivider />

      {/* CREATE FAKE MESSAGE Section */}
      <FormSection title="CREATE FAKE MESSAGE">
        <FormRow
          label="Create a fake message in someone's DM"
          leading={<FormRow.Icon source={getAssetIDByName("ic_edit_24px")} />}
        />
      </FormSection>

      <FormDivider />

      {/* TARGET USER ID */}
      <FormSection title="TARGET USER ID (Whose DM)">
        <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
          User ID of person whose DM you want to inject into
        </FormText>
        <FormInput
          value={targetUserId}
          onChange={(value) => setTargetUserId(value)}
          placeholder="Enter target user ID"
          title="Target User ID"
        />
        <TouchableOpacity
          style={{
            backgroundColor: "#5865F2",
            padding: 15,
            borderRadius: 8,
            marginTop: 10,
            marginHorizontal: 15,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={pasteTargetUserId}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            📋 Paste Target User ID
          </Text>
        </TouchableOpacity>
      </FormSection>

      <FormDivider />

      {/* FROM USER ID */}
      <FormSection title="FROM USER ID (Who message is from)">
        <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
          User ID of who the message appears to be from
        </FormText>
        <FormInput
          value={fromUserId}
          onChange={(value) => setFromUserId(value)}
          placeholder="Enter sender user ID"
          title="From User ID"
        />
        <TouchableOpacity
          style={{
            backgroundColor: "#5865F2",
            padding: 15,
            borderRadius: 8,
            marginTop: 10,
            marginHorizontal: 15,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={pasteSenderUserId}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            📋 Paste Sender User ID
          </Text>
        </TouchableOpacity>
      </FormSection>

      <FormDivider />

      {/* MESSAGE CONTENT */}
      <FormSection title="MESSAGE CONTENT">
        <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
          The message text
        </FormText>
        <FormInput
          value={messageContent}
          onChange={(value) => setMessageContent(value)}
          placeholder="Enter message content"
          title="Message Content"
        />
      </FormSection>

      <FormDivider />

      {/* EMBED TOGGLE */}
      <FormSwitchRow
        label="Optional: Add an embed"
        leading={<FormRow.Icon source={getAssetIDByName("ic_link")} />}
        value={embedEnabled}
        onValueChange={(value) => setEmbedEnabled(value)}
      />

      <FormDivider />

      {/* EMBED FIELDS (only show if enabled) */}
      {embedEnabled && (
        <>
          <FormSection title="EMBED TITLE">
            <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
              Optional embed title
            </FormText>
            <FormInput
              value={embedTitle}
              onChange={(value) => setEmbedTitle(value)}
              placeholder="Optional embed title"
              title="Embed Title"
            />
          </FormSection>

          <FormDivider />

          <FormSection title="EMBED DESCRIPTION">
            <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
              Optional embed description
            </FormText>
            <FormInput
              value={embedDescription}
              onChange={(value) => setEmbedDescription(value)}
              placeholder="Optional embed description"
              title="Embed Description"
            />
          </FormSection>

          <FormDivider />

          <FormSection title="EMBED IMAGE URL">
            <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
              Optional image URL
            </FormText>
            <FormInput
              value={embedImageUrl}
              onChange={(value) => setEmbedImageUrl(value)}
              placeholder="Optional image URL"
              title="Embed Image URL"
            />
          </FormSection>

          <FormDivider />
        </>
      )}

      {/* ACTION BUTTONS */}
      <View style={{ padding: 15 }}>
        {/* Send Fake Message Button */}
        <TouchableOpacity
          style={{
            backgroundColor: "#3BA55D",
            padding: 15,
            borderRadius: 8,
            marginBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={sendFakeMessage}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            📧 Send Fake Message
          </Text>
        </TouchableOpacity>

        {/* Quick Test Message Button */}
        <TouchableOpacity
          style={{
            backgroundColor: "#F26522",
            padding: 15,
            borderRadius: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
          }}
          onPress={quickTestMessage}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
            ✏️ Quick Test Message
          </Text>
        </TouchableOpacity>
      </View>

      <FormDivider />

      {/* CONSOLE API Section */}
      <FormSection title="CONSOLE API">
        <FormText style={{ color: semanticColors.TEXT_MUTED, marginBottom: 10 }}>
          You can also use the console for advanced usage:
        </FormText>
        <FormText style={{ color: semanticColors.TEXT_NORMAL, fontFamily: "monospace", fontSize: 12 }}>
          window.messageFaker.inject(channelId, authorId, content, embed)
        </FormText>
      </FormSection>

      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

// Plugin entry point
export default {
  onLoad: () => {
    // Expose API to console for advanced users
    window.messageFaker = {
      inject: injectFakeMessage,
      createMessage: createFakeMessage,
      getDMChannel: getDMChannel,
    };

    console.log("[Message Faker] Plugin loaded successfully!");
  },
  onUnload: () => {
    // Clean up patches
    patches.forEach(unpatch => unpatch());
    patches = [];
    
    // Remove console API
    delete window.messageFaker;
    
    console.log("[Message Faker] Plugin unloaded successfully!");
  },
  settings: Settings,
};

