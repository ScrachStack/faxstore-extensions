const config = {
    guildId: "1119734000974565439", // 
    commandColor: 0x00a2ff,
    createColor: 0x00ffb3
};

// DO NOT EDIT BELOW THIS LINE


const axios = require('axios');
const {
    Collection,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
} = require("discord.js");

const commands = new Collection();
const events = new Collection();
const buttons = new Collection();
const contextMenus = new Collection();

const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1023456789-_'.split('');

const keyGenerator = () => {
    let key = "";
    for (let i = 0; i < 46; i++)
        key += characters[Math.floor(Math.random() * characters.length)];
    return key;
};

const update = (client, column, variable, id) => {
    client.db.query(
        `UPDATE licensesystem SET ${column} = ${variable} WHERE id = ${id};`,
        (err) => {
            if (err) console.error(`[Sync Studios] SQL Update Error: ${err.message}`);
        }
    );
};


module.exports = async function (app, connection, client, faxstore) {

    faxstore.registerExtension({
        name: 'License Bot',
        description: 'Bot that works with the license system.',
        icon: 'https://weblutions.com/assets/logo.png',
        version: '1.0.0',
        author: 'SCRATCHSTACK',
        url: 'https://github.com/ScrachStack/faxstore-extensions/tree/patch-1/License%20Bot',
    }, __filename);

    console.log(`[Sync Studios] [EXT] License Bot Loaded`);

   // faxstore.on('login', async (userObject, DbUserResults) => {

 //   });

    client.db = connection;

    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
        console.log(`[Sync Studios] Guild not found (ID: ${config.guildId}). Make sure the bot is in that server.`);
        return;
    }

    const keyCommandData = {
        name: "keys",
        description: "Manage or view authorization keys.",
        options: [
            {
                name: "manage",
                description: "Manage license keys",
                type: 2,
                options: [
                    {
                        name: "create",
                        description: "Create a new license key.",
                        type: 1,
                        options: [
                            {
                                name: "member",
                                description: "Discord user to link this key to.",
                                type: 6, // USER
                                required: true
                            },
                            {
                                name: "product",
                                description: "Product name to link the key to.",
                                type: 3, // STRING
                                required: true
                            },
                            {
                                name: "ip",
                                description: "IP to authorize.",
                                type: 3
                            },
                            {
                                name: "locked",
                                description: "Whether IP locked (default yes)",
                                type: 5 // BOOLEAN
                            }
                        ]
                    },
                    {
                        name: "delete",
                        description: "Delete a license key.",
                        type: 1,
                        options: [
                            {
                                name: "key",
                                description: "Key string to delete.",
                                type: 3
                            },
                            {
                                name: "user",
                                description: "Delete all keys for user.",
                                type: 6
                            },
                            {
                                name: "ip",
                                description: "Delete all keys for IP.",
                                type: 3
                            },
                            {
                                name: "id",
                                description: "Numerical key ID.",
                                type: 10
                            }
                        ]
                    }
                ]
            },
            {
                name: "view",
                description: "View license key info",
                type: 1,
                options: [
                    {
                        name: "key",
                        description: "License key to view.",
                        type: 3
                    },
                    {
                        name: "id",
                        description: "Numerical ID to view.",
                        type: 10
                    }
                ]
            }
        ]
    };

    await guild.commands.create(keyCommandData);
    console.log(`[Sync Studios] Commands Registered ${guild.name}`);

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === "keys") {
            const sub = interaction.options.getSubcommandGroup(false);
            const subCmd = interaction.options.getSubcommand(false);

            if (sub === "manage" && subCmd === "create") {
                const user = interaction.options.getUser("member");
                const product = interaction.options.getString("product");
                const ip = interaction.options.getString("ip") || "127.0.0.1";
                const locked = interaction.options.getBoolean("locked") ?? true;
                const key = keyGenerator();

                client.db.query(
                    `INSERT INTO licensesystem (userId, productName, productId, authStatus, totalRequests, lastRequest, authIP, authKey, authStatusForced, iplocked, ownedid)
                     VALUES ('${user.id}', '${product}', 0, 1, 0, '', '${ip}', '${key}', 0, ${locked ? 1 : 0}, 0);`,
                    (err, result) => {
                        if (err) {
                            console.error(`[Sync Studios] SQL Insert Error: ${err.message}`);
                            return interaction.reply({ content: "Database error while creating key.", ephemeral: true });
                        }

                        const embed = new EmbedBuilder()
                            .setColor(config.createColor)
                            .setTitle("License Key Created")
                            .setDescription(`**Key ID:** ${result.insertId}\n**User:** ${user.tag}\n**Product:** ${product}\n**Locked:** ${locked ? "✅" : "❌"}\n\n\`\`\`${key}\`\`\``)
                            .setFooter({ text: "FaxStore License System", iconURL: client.user.displayAvatarURL() });

                        interaction.reply({ embeds: [embed], ephemeral: true });
                        console.log(`[Sync Studios] Created License Key #${result.insertId} for ${user.tag}`);
                    }
                );
            }

            if (subCmd === "view") {
                const key = interaction.options.getString("key");
                const id = interaction.options.getNumber("id");
                let query = "";

                if (id) query = `id = ${id}`;
                else if (key) query = `authKey = '${key}'`;
                else return interaction.reply({ content: "Provide either a key or an ID.", ephemeral: true });

                client.db.query(`SELECT * FROM licensesystem WHERE ${query}`, async (err, res) => {
                    if (err) {
                        console.error(`[Sync Studios] SQL Select Error: ${err.message}`);
                        return interaction.reply({ content: "Database error occurred.", ephemeral: true });
                    }

                    if (!res?.length)
                        return interaction.reply({ content: "License key not found.", ephemeral: true });

                    const data = res[0];
                    const owner = await client.users.fetch(data.userId).catch(() => null);
                    const embed = new EmbedBuilder()
                        .setColor(config.commandColor)
                        .setTitle(`License Key #${data.id}`)
                        .setDescription(
                            `**Owner:** ${owner ? owner.tag : data.userId}\n` +
                            `**Product:** ${data.productName}\n` +
                            `**Auth IP:** ${data.authIP}\n` +
                            `**Status:** ${data.authStatus ? "Active ✅" : "Inactive ❌"}\n` +
                            `**IP Locked:** ${data.iplocked ? "✅" : "❌"}`
                        )
                        .setFooter({ text: data.authKey.slice(0, 25) + "********" });

                    interaction.reply({ embeds: [embed], ephemeral: true });
                    console.log(`[Sync Studios] Viewed License Key #${data.id}`);
                });
            }
        }
    });

    console.log(`[Sync Studios] License Bot initialized.`);
};

