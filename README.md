# Github action 教程

## 测试上传证书

根据输入的`环境`和`域名`将证书上传到AWS, 脚本文件: cert.yaml

本地测试:
```
# 部署
act
act --input action=true 

# 销毁
act --input action=false
```
注意: `.input`是本地测试`act`工具默认加载的输入文件,模拟参数输入.

# Signing Code

```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```
