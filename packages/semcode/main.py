import time
import torch
import torch.nn.functional as F

from torch import Tensor
from transformers import AutoTokenizer, AutoModel


def last_token_pool(last_hidden_states: Tensor,
                 attention_mask: Tensor) -> Tensor:
    left_padding = (attention_mask[:, -1].sum() == attention_mask.shape[0])
    if left_padding:
        return last_hidden_states[:, -1]
    else:
        sequence_lengths = attention_mask.sum(dim=1) - 1
        batch_size = last_hidden_states.shape[0]
        return last_hidden_states[torch.arange(batch_size, device=last_hidden_states.device), sequence_lengths]


# Each query must come with a one-sentence instruction that describes the task
queries = [
      'how to handle memory efficient data streaming',
      'authentication code'
  ]

documents = [
        """"
        declare module 'next-auth' {
            interface Session {
                user: {
                    id: string;
                } & DefaultSession['user'];
            }
        }

        declare module 'next-auth/jwt' {
            interface JWT {
                userId: string
            }
        }

        """,

        """class LazyLoader:
            def __init__(self, source):
                self.generator = iter(source)
                self._cache = []

            def next_batch(self, size=100):
                while len(self._cache) < size:
                    try:
                        self._cache.append(next(self.generator))
                    except StopIteration:
                        break
                return self._cache.pop(0) if self._cache else None""",

        """def dfs_recursive(root):
            if not root:
                return []
            stack = []
            stack.extend(dfs_recursive(root.right))
            stack.append(root.val)
            stack.extend(dfs_recursive(root.left))
            return stack"""
    ]
input_texts = queries + documents

# model_name = 'Qodo/Qodo-Embed-1-1.5B'
# model_name = 'Salesforce/SFR-Embedding-Code-400M_R'
model_name = 'sentence-transformers/all-MiniLM-L6-v2'
tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
model = AutoModel.from_pretrained(model_name, trust_remote_code=True)

max_length = 8192

# Tokenize the input texts
print("Tokenizing...")
batch_dict = tokenizer(input_texts, max_length=max_length, padding=True, truncation=True, return_tensors='pt')

print("Embedding...")
start_time = time.time()
outputs = model(**batch_dict)
print(f"Embedding took {time.time() - start_time:.2f} seconds")

print("Pooling...")
embeddings = last_token_pool(outputs.last_hidden_state, batch_dict['attention_mask'])

print("Normalizing...")
# normalize embeddings
embeddings = F.normalize(embeddings, p=2, dim=1)
scores = (embeddings[:2] @ embeddings[2:].T) * 100
print(scores.tolist())