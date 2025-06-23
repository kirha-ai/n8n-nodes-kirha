import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import OpenAI from "openai";

export class KirhaChatTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kirha Chat Tool',
		name: 'kirhaChatTool',
		version: 1,
		description: 'Agent tool to access Kirha realtime AI data provider',
		icon: { light: 'file:openAiLight.svg', dark: 'file:openAiLight.dark.svg' },
		group: ['transform'],
		defaults: {
			name: 'Kirha Chat Tool',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Text Completion Models'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://kirha.gitbook.io/kirha-api/completion-api/chat-completion-openai/',
					},
				],
			},
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		outputNames: ['Model'],
		usableAsTool: true,
		credentials: [
			{
				name: 'kirhaApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: "https://api.kirha.ai/chat/v1"
		},
		properties: [
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: "GET",
								url: "https://api.kirha.ai/chat/v1/openai/models"
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'data',
										},
									},
									{
										type: 'filter',
										properties: {
											pass: '={{ $responseItem.active === true && $responseItem.object === "model" }}',
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{$responseItem.id}}',
											value: '={{$responseItem.id}}',
										},
									},
								]
							}
						}
					}
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
				description: 'The model which will generate the completion. <a href="https://kirha.gitbook.io/kirha-api/completion-api/models-and-limits">Learn more</a>.',
				default: 'openai:gpt-4.1', // eslint-disable-line n8n-nodes-base/node-param-default-wrong-for-options
			},
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				default: '',
				description: 'Optional system prompt to inject at the start of the chat',
				typeOptions: {
					rows: 3,
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Sampling Temperature',
						name: 'temperature',
						default: 0.5,
						typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
						description: 'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
						type: 'number',
					},
				],
			},
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				typeOptions: {
					expression: true,
				},
				default: '={{ $fromAI("prompt", "", "string") }}',
				required: true,
				description: 'Prompt injected by the Agent Node',
			}
		],
	};

	async execute(this: IExecuteFunctions) {
		const items = this.getInputData();
		const returnData = [];

		const credentials = await this.getCredentials('kirhaApi');

		for (let i = 0; i < items.length; i++) {
			const prompt = this.getNodeParameter('prompt', i) as string;
			const modelName = this.getNodeParameter('model', i) as string;
			const temperature = this.getNodeParameter('options.temperature', i, 0.5) as number;
			const systemPrompt = this.getNodeParameter('systemPrompt', i, '') as string;

			const messages: OpenAI.ChatCompletionMessageParam[] = [];

			if (systemPrompt) {
				messages.push({ role: "system", content: systemPrompt });
			}

			messages.push({ role: "user", content: prompt });

			const openaiClient = new OpenAI({
				apiKey: credentials.apiKey as string,
				baseURL: "https://api.kirha.ai/chat/v1/openai/crypto",
			});

			const response = await openaiClient.chat.completions.create({
				model: modelName,
				messages,
				temperature,
				stream: false,
			});

			returnData.push({ json: { result: response } });
		}

		return [returnData];
	}
}
